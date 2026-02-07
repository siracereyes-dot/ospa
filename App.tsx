
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
  "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
  "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
  "Quezon City", "San Juan", "Taguig City and Pateros (TAPAT)", "Valenzuela"
];

// Ensure this URL points to your deployed Google Apps Script Web App
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
      alert("Invalid format: Please upload a consolidated PDF only.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      alert("File too large: Please keep the PDF under 20MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      setData(prev => ({
        ...prev,
        movFile: {
          name: file.name,
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
      alert("Please complete all required fields (Division, School, Name, and MOV PDF).");
      return;
    }

    setIsSubmitting(true);

    // Apply strict naming convention: Division_SchoolName_CandidateName.pdf
    const sanitizedCandidate = data.candidateName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const sanitizedSchool = data.schoolName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const finalFileName = `${data.division}_${sanitizedSchool}_${sanitizedCandidate}.pdf`;
    
    const updatedMOV = data.movFile ? { ...data.movFile, name: finalFileName } : null;

    const payload = {
      timestamp: new Date().toISOString(),
      candidateName: data.candidateName,
      division: data.division,
      schoolName: data.schoolName,
      averageRating: averageRating.toFixed(3),
      grandTotal: totals.grandTotal.toFixed(2),
      movFile: updatedMOV,
      details: {
        journalism: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2),
        leadership: totals.leadershipTotal.toFixed(2),
        extensions: (totals.extension + totals.innovations + totals.speakership).toFixed(2),
        interview: totals.interviewTotal.toFixed(2)
      },
      rawJson: JSON.stringify(data)
    };

    try {
      // POST to Google Apps Script
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      alert(`Submission successful!\n\nFile saved as: ${finalFileName}\nData recorded to the OSPA database.`);
      setShowValidationErrors(false);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Submission failed. Ensure your Google Apps Script is correctly configured.");
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
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 mb-8 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
        <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">
          Weighted: {totals[category as keyof typeof totals]?.toFixed(2) || '0.00'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <select id={`${category}-lvl`} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select id={`${category}-rnk`} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
          {ranks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input id={`${category}-yr`} type="text" placeholder="Year" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50" />
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
          className="bg-indigo-600 text-white px-6 py-4 rounded-2xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100"
        >
          Add Achievement
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="py-4 px-2">Level</th>
              <th className="py-4 px-2">Rank</th>
              <th className="py-4 px-2">Year</th>
              <th className="py-4 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data[category] as Achievement[]).map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-2 text-xs font-bold text-slate-700">{item.level}</td>
                <td className="py-4 px-2 text-xs font-bold text-slate-700">{item.rank}</td>
                <td className="py-4 px-2 text-xs font-bold text-slate-700">{item.year}</td>
                <td className="py-4 px-2 text-right">
                  <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </td>
              </tr>
            ))}
            {(data[category] as Achievement[]).length === 0 && (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-[10px] font-bold italic tracking-widest">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderServiceSection = (title: string, category: keyof OSPAScoreState, levels: Level[]) => (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
        <span className="bg-emerald-600 text-white px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">
          Weighted: {totals[category as keyof typeof totals]?.toFixed(2) || '0.00'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <select id={`${category}-slvl`} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-50">
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button 
          onClick={() => {
            const lvl = (document.getElementById(`${category}-slvl`) as HTMLSelectElement).value as Level;
            addItem(category, { level: lvl });
          }}
          className="bg-emerald-600 text-white px-6 py-4 rounded-2xl hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 col-span-2"
        >
          Add Service Entry
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="py-4 px-2">Level</th>
              <th className="py-4 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data[category] as ServiceEntry[]).map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-2 text-xs font-bold text-slate-700">{item.level}</td>
                <td className="py-4 px-2 text-right">
                  <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </td>
              </tr>
            ))}
            {(data[category] as ServiceEntry[]).length === 0 && (
              <tr><td colSpan={2} className="py-12 text-center text-slate-400 text-[10px] font-bold italic tracking-widest">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[100] h-24">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-2xl shadow-indigo-200">
              <i className="fas fa-feather-pointed"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-indigo-950 tracking-tight leading-none">OSPA DASHBOARD</h1>
              <p className="text-[10px] text-slate-400 font-black tracking-[0.3em] uppercase mt-1">Outstanding School Paper Adviser</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-12">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
              <p className="text-4xl font-black text-indigo-600 tabular-nums">{totals.grandTotal.toFixed(2)}</p>
            </div>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-10 py-4.5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl ${isSubmitting ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200'}`}
            >
              {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
              {isSubmitting ? 'Syncing...' : 'Sync to Sheet'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 sticky top-36 space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                <label className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Nominee Profile</label>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Division</label>
                  <select 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.division ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.division}
                    onChange={e => setData({...data, division: e.target.value})}
                  >
                    <option value="">Select...</option>
                    {NCR_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">School</label>
                  <input 
                    type="text" 
                    placeholder="School Name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.schoolName.trim() ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.schoolName}
                    onChange={e => setData({...data, schoolName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Candidate Name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.candidateName.trim() ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.candidateName}
                    onChange={e => setData({...data, candidateName: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Consolidated MOV (PDF)</label>
                  <div className={`relative border-2 border-dashed rounded-[1.5rem] p-6 transition-all text-center group ${data.movFile ? 'border-emerald-500 bg-emerald-50' : (showValidationErrors && !data.movFile ? 'border-red-500 bg-red-50 animate-pulse' : 'border-slate-100 hover:border-indigo-400 bg-slate-50')}`}>
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                    <i className={`fas ${data.movFile ? 'fa-circle-check text-emerald-500' : 'fa-file-pdf text-slate-300 group-hover:text-indigo-400'} text-3xl mb-3`}></i>
                    <p className={`text-[9px] font-black uppercase tracking-widest truncate ${data.movFile ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {data.movFile ? data.movFile.name : 'Required PDF Upload'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5 pt-8 border-t border-slate-100">
              {[
                { id: 'basic', label: 'Ratings Dashboard', icon: 'fa-chart-pie' },
                { id: 'contests', label: 'Journalism Winnings', icon: 'fa-trophy' },
                { id: 'leadership', label: 'Leadership Roles', icon: 'fa-user-shield' },
                { id: 'services', label: 'Extension Services', icon: 'fa-paper-plane' },
                { id: 'interview', label: 'Panel Interview', icon: 'fa-user-pen' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4.5 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
                >
                  <i className={`fas ${tab.icon} w-5 text-center`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-10">
          {activeTab === 'basic' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
               <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
                  <div className="flex items-center gap-6 mb-12">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-2xl">
                      <i className="fas fa-clipboard-check"></i>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">IPCRF Performance</h2>
                      <p className="text-slate-400 text-[11px] font-black tracking-widest uppercase mt-1">Average rating of the last 5 evaluation cycles</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {data.performanceRatings.map((entry) => (
                      <div key={entry.year} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{entry.year}</label>
                        <input 
                          type="number" step="0.001"
                          className="w-full bg-transparent text-2xl font-black text-indigo-600 outline-none group-focus-within:text-indigo-900"
                          value={entry.score}
                          onChange={(e) => updateRating(entry.year, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 p-10 bg-indigo-600 rounded-[3rem] flex items-center justify-between text-white shadow-3xl shadow-indigo-100 relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 text-[10rem] opacity-5 transition-transform group-hover:scale-110">
                       <i className="fas fa-medal"></i>
                    </div>
                    <div className="flex items-center gap-8 relative z-10">
                       <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center text-4xl">
                         <i className="fas fa-star"></i>
                       </div>
                       <div>
                         <p className="text-[11px] font-black text-indigo-200 uppercase tracking-widest mb-1">Final Performance Average</p>
                         <p className="text-5xl font-black tabular-nums">{averageRating.toFixed(3)}</p>
                       </div>
                    </div>
                    <div className="px-8 py-4 bg-white text-indigo-600 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest relative z-10 shadow-lg">
                      {averageRating >= 4.5 ? 'Outstanding' : averageRating >= 3.5 ? 'Very Satisfactory' : 'Needs Review'}
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Journalism', value: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2), icon: 'fa-feather', color: 'text-amber-500' },
                    { label: 'Leadership', value: totals.leadershipTotal.toFixed(2), icon: 'fa-shield-halved', color: 'text-indigo-500' },
                    { label: 'Extensions', value: (totals.extension + totals.innovations + totals.speakership).toFixed(2), icon: 'fa-rocket', color: 'text-emerald-500' },
                    { label: 'Interview', value: totals.interviewTotal.toFixed(2), icon: 'fa-comment-dots', color: 'text-blue-500' }
                  ].map((stat, i) => (
                    <div key={i} className="p-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95 group">
                      <div className={`w-12 h-12 ${stat.color} bg-slate-50 rounded-2xl flex items-center justify-center mb-5 text-2xl group-hover:rotate-6 transition-transform`}>
                        <i className={`fas ${stat.icon}`}></i>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'contests' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              {renderAchievementSection('1. Individual Journalism Contests', 'individualContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('2. Group Journalism Contests', 'groupContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('2.1 Special Awards (Group)', 'specialAwards', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('3. School Publication Contests', 'publicationContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'leadership' && (
            <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200 animate-in fade-in">
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-2xl">
                     <i className="fas fa-user-shield"></i>
                   </div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight">Leadership & Positions</h3>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Weighted Score</span>
                  <span className="text-5xl font-black text-indigo-600 tracking-tight">{totals.leadershipTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Org Level</label>
                   <select id="lead-lvl" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
                     <option value={Level.NATIONAL}>National</option>
                     <option value={Level.REGIONAL}>Regional</option>
                     <option value={Level.DIVISION}>Division</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Designation</label>
                   <select id="lead-pos" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
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
                     className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                   >
                     Add Leadership Record
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                {data.leadership.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-300 transition-all group">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-slate-50 text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center text-2xl transition-all">
                        <i className="fas fa-award"></i>
                      </div>
                      <div>
                        <p className="font-black text-slate-800 tracking-tight">{item.position}</p>
                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">{item.level} Level</p>
                      </div>
                    </div>
                    <button onClick={() => removeItem('leadership', item.id)} className="w-12 h-12 flex items-center justify-center text-red-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                      <i className="fas fa-times-circle text-xl"></i>
                    </button>
                  </div>
                ))}
                {data.leadership.length === 0 && (
                  <div className="text-center py-16 text-slate-400 text-[11px] font-black italic tracking-widest uppercase">Zero entries recorded for leadership.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              {renderServiceSection('5. Extension Services (Facilitator/Org)', 'extensionServices', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('Innovations & Advocacies', 'innovations', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION, Level.DISTRICT, Level.SCHOOL])}
              {renderServiceSection('6. Resource Speakership & Judging', 'speakership', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('7. Books, Modules & Workbooks', 'publishedBooks', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('8. Articles in Journals/Local Papers', 'publishedArticles', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200 animate-in fade-in">
              <div className="flex justify-between items-center mb-16">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-2xl">
                     <i className="fas fa-user-pen"></i>
                   </div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight">Panel Interview Grade</h3>
                </div>
                <div className="text-right">
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Weighted (Max 10)</span>
                   <span className="text-5xl font-black text-blue-600 tabular-nums tracking-tight">{totals.interviewTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-16 max-w-3xl mx-auto">
                {[
                  { key: 'principles', label: 'Journalism Principles & Ethics' },
                  { key: 'leadership', label: 'Leadership & Mentorship potential' },
                  { key: 'engagement', label: 'Campus Journalism Engagement' },
                  { key: 'commitment', label: 'Personal & Professional Commitment' },
                  { key: 'communication', label: 'Oral Communication Excellence' }
                ].map(indicator => (
                  <div key={indicator.key} className="space-y-6">
                    <div className="flex justify-between items-end">
                      <label className="font-black text-slate-800 text-[11px] uppercase tracking-widest">{indicator.label}</label>
                      <div className="px-5 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black tracking-widest tabular-nums uppercase">
                        {data.interview[indicator.key as keyof InterviewScores].toFixed(1)} / 1.0
                      </div>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={data.interview[indicator.key as keyof InterviewScores]}
                      onChange={e => setData({ ...data, interview: { ...data.interview, [indicator.key]: parseFloat(e.target.value) } })}
                      className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Sticky Total */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-6 flex items-center justify-between shadow-3xl z-[200] rounded-t-[3rem]">
        <div className="flex flex-col">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Score</p>
          <p className="text-4xl font-black text-indigo-600 leading-none">{totals.grandTotal.toFixed(2)}</p>
        </div>
        <button 
          onClick={handleSubmit}
          className="bg-indigo-600 text-white px-12 py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-2xl shadow-indigo-100"
        >
          {isSubmitting ? '...' : 'Sync Data'}
        </button>
      </div>
    </div>
  );
};

export default App;
