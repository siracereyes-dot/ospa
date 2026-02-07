
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

// PROD SCRIPT URL
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
      alert("Please upload a PDF document.");
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

  const handleSave = async () => {
    if (!isFormValid) {
      setShowValidationErrors(true);
      setActiveTab('basic');
      alert("⚠️ Profile Incomplete: Please provide Division, School Name, Nominee Name, and the PDF Portfolio.");
      return;
    }

    setIsSubmitting(true);
    const sanitizedName = data.candidateName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const sanitizedSchool = data.schoolName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const finalFileName = `${data.division}_${sanitizedSchool}_${sanitizedName}.pdf`;
    
    const payload = {
      timestamp: new Date().toLocaleString(),
      candidateName: data.candidateName,
      division: data.division,
      schoolName: data.schoolName,
      averageRating: averageRating.toFixed(3),
      grandTotal: totals.grandTotal.toFixed(2),
      movFile: data.movFile ? { ...data.movFile, name: finalFileName } : null,
      details: {
        journalism: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2),
        leadership: totals.leadershipTotal.toFixed(2),
        extensions: (totals.extension + totals.innovations + totals.speakership + totals.books + totals.articles).toFixed(2),
        interview: totals.interviewTotal.toFixed(2)
      }
    };

    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      alert(`✅ Success! Data for ${data.candidateName} has been submitted.\nCheck your Google Sheet and Drive folder.`);
      setShowValidationErrors(false);
    } catch (error) {
      console.error("Save Error:", error);
      alert("❌ Submission Failed: Please check your internet connection or verify the Google Script deployment.");
    } finally {
      setIsSubmitting(false);
    }
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

  const renderSectionHeader = (title: string, icon: string, value: string, color: string) => (
    <div className="flex justify-between items-center mb-10">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 ${color} bg-opacity-10 ${color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center text-2xl`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Component Rating</p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Weight Value</span>
        <span className="text-4xl font-black text-slate-900 tabular-nums">{value}</span>
      </div>
    </div>
  );

  const renderAchievementSection = (title: string, category: keyof OSPAScoreState, ranks: Rank[], levels: Level[]) => {
    const getVal = () => {
      if(category === 'individualContests') return totals.indiv;
      if(category === 'groupContests') return totals.group;
      if(category === 'specialAwards') return totals.special;
      if(category === 'publicationContests') return totals.pub;
      return 0;
    };
    return (
      <div className="elegant-card p-10 rounded-[2.5rem] mb-8 border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          <span className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            Score: {getVal().toFixed(2)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Level</label>
            <select id={`${category}-lvl`} className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none focus:ring-4 focus:ring-indigo-50">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Rank</label>
            <select id={`${category}-rnk`} className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none focus:ring-4 focus:ring-indigo-50">
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Year</label>
            <input id={`${category}-yr`} type="text" placeholder="2024" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none focus:ring-4 focus:ring-indigo-50" />
          </div>
          <div className="flex items-end">
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
              className="w-full bg-slate-900 text-white p-4 rounded-2xl hover:bg-black transition-all font-black text-[10px] uppercase tracking-widest"
            >
              Add Award
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                <th className="py-4 px-2">Level</th>
                <th className="py-4 px-2">Rank</th>
                <th className="py-4 px-2">Year</th>
                <th className="py-4 px-2 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data[category] as Achievement[]).map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-5 px-2 text-[11px] font-black text-slate-700">{item.level}</td>
                  <td className="py-5 px-2 text-[11px] font-black text-slate-700">{item.rank}</td>
                  <td className="py-5 px-2 text-[11px] font-black text-slate-700">{item.year}</td>
                  <td className="py-5 px-2 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-2xl text-red-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <i className="fas fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as Achievement[]).length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-slate-300 text-xs italic">No awards listed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServiceSection = (title: string, category: keyof OSPAScoreState, levels: Level[]) => {
    const getVal = () => {
      if(category === 'extensionServices') return totals.extension;
      if(category === 'innovations') return totals.innovations;
      if(category === 'speakership') return totals.speakership;
      if(category === 'publishedBooks') return totals.books;
      if(category === 'publishedArticles') return totals.articles;
      return 0;
    };
    return (
      <div className="elegant-card p-10 rounded-[2.5rem] mb-8 border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          <span className="bg-emerald-50 text-emerald-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            Score: {getVal().toFixed(2)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Service Level</label>
            <select id={`${category}-slvl`} className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                 const lvl = (document.getElementById(`${category}-slvl`) as HTMLSelectElement).value as Level;
                 addItem(category, { level: lvl });
              }}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl hover:bg-black transition-all font-black text-[10px] uppercase tracking-widest"
            >
              Add Entry
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                <th className="py-4 px-2">Service Level</th>
                <th className="py-4 px-2 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data[category] as ServiceEntry[]).map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-5 px-2 text-[11px] font-black text-slate-700">{item.level}</td>
                  <td className="py-5 px-2 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-2xl text-red-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <i className="fas fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as ServiceEntry[]).length === 0 && (
                <tr><td colSpan={2} className="py-12 text-center text-slate-300 text-xs italic">No entries listed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50/30">
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-[100] h-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xl shadow-indigo-100">
              <i className="fas fa-feather-pointed"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">OSPA <span className="text-indigo-600">Scorer</span></h1>
              <p className="text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">Professional Scoring App</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-12">
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
              <p className="text-4xl font-black text-indigo-600 tabular-nums leading-none tracking-tighter">{totals.grandTotal.toFixed(2)}</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSubmitting}
              className={`px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${isSubmitting ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02] active:scale-95 shadow-2xl shadow-slate-200'}`}
            >
              {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
              {isSubmitting ? 'Processing...' : 'Submit Entry'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 sticky top-32 space-y-10 shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-7 bg-indigo-600 rounded-full"></div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Profile</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2 tracking-widest ml-1">Division</label>
                  <select 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-[11px] font-black outline-none transition-all ${showValidationErrors && !data.division ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.division}
                    onChange={e => setData({...data, division: e.target.value})}
                  >
                    <option value="">Select Division</option>
                    {NCR_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2 tracking-widest ml-1">School Name</label>
                  <input 
                    type="text" placeholder="Full School Name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-[11px] font-black outline-none transition-all ${showValidationErrors && !data.schoolName.trim() ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.schoolName}
                    onChange={e => setData({...data, schoolName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2 tracking-widest ml-1">Nominee Name</label>
                  <input 
                    type="text" placeholder="Nominee's Name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-[11px] font-black outline-none transition-all ${showValidationErrors && !data.candidateName.trim() ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.candidateName}
                    onChange={e => setData({...data, candidateName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-3 tracking-widest ml-1">PDF Portfolio</label>
                  <div className={`relative border-2 border-dashed rounded-[1.5rem] p-6 text-center group cursor-pointer transition-all ${data.movFile ? 'border-emerald-200 bg-emerald-50' : (showValidationErrors && !data.movFile ? 'border-red-200 bg-red-50 animate-pulse' : 'border-slate-100 hover:border-indigo-300 bg-slate-50')}`}>
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                    <i className={`fas ${data.movFile ? 'fa-check-circle text-emerald-500' : 'fa-file-pdf text-slate-300'} text-3xl mb-3`}></i>
                    <p className={`text-[9px] font-black uppercase tracking-widest truncate ${data.movFile ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {data.movFile ? data.movFile.name : 'Upload MOVs'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-3 pt-8 border-t border-slate-50">
              {[
                { id: 'basic', label: 'Summary', icon: 'fa-chart-pie' },
                { id: 'contests', label: 'Awards', icon: 'fa-trophy' },
                { id: 'leadership', label: 'Leaders', icon: 'fa-user-tie' },
                { id: 'services', label: 'Expertise', icon: 'fa-microscope' },
                { id: 'interview', label: 'Interview', icon: 'fa-comments' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
                >
                  <i className={`fas ${tab.icon} w-5 text-center`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-12 pb-20 no-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="elegant-card p-12 rounded-[3.5rem]">
                <div className="flex items-center gap-6 mb-12">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl">
                    <i className="fas fa-star"></i>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">IPCRF Ratings</h2>
                    <p className="text-slate-400 text-sm font-medium">Ratings for the last 5 evaluation cycles.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {data.performanceRatings.map((entry) => (
                    <div key={entry.year} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group transition-all hover:border-indigo-200">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{entry.year}</label>
                      <input 
                        type="number" step="0.001"
                        className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none group-focus-within:text-indigo-600"
                        value={entry.score}
                        onChange={(e) => {
                           const val = parseFloat(e.target.value) || 0;
                           setData(prev => ({
                             ...prev,
                             performanceRatings: prev.performanceRatings.map(r => r.year === entry.year ? { ...r, score: val } : r)
                           }));
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-12 bg-slate-900 rounded-[3rem] flex items-center justify-between text-white">
                  <div className="flex items-center gap-10">
                    <div className="w-20 h-20 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-4xl">
                      <i className="fas fa-calculator"></i>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Aggregate Rating Average</p>
                      <p className="text-6xl font-black tabular-nums tracking-tighter">{averageRating.toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest">
                    {averageRating >= 4.5 ? 'Outstanding' : 'Satisfactory'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { label: 'Journalism', value: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2), icon: 'fa-pen-nib', color: 'bg-amber-500' },
                  { label: 'Leadership', value: totals.leadershipTotal.toFixed(2), icon: 'fa-user-tie', color: 'bg-indigo-500' },
                  { label: 'Extension', value: (totals.extension + totals.innovations + totals.speakership + totals.books + totals.articles).toFixed(2), icon: 'fa-microscope', color: 'bg-emerald-500' },
                  { label: 'Interview', value: totals.interviewTotal.toFixed(2), icon: 'fa-comments', color: 'bg-blue-500' }
                ].map((stat, i) => (
                  <div key={i} className="elegant-card p-10 rounded-[3rem] group">
                    <div className={`w-16 h-16 ${stat.color} bg-opacity-10 ${stat.color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center mb-8 text-3xl transition-all`}>
                      <i className={`fas ${stat.icon}`}></i>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                    <p className="text-4xl font-black text-slate-900 tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contests' && (
            <div className="space-y-4 animate-in fade-in duration-500">
               {renderAchievementSection('1. Individual Journalism Contests', 'individualContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderAchievementSection('2. Group Journalism Contests', 'groupContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderAchievementSection('2.1 Special Awards (Group)', 'specialAwards', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderAchievementSection('3. School Publication Contests', 'publicationContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'leadership' && (
            <div className="elegant-card p-12 rounded-[3.5rem] animate-in fade-in">
              {renderSectionHeader('Leadership Portfolio', 'fa-award', totals.leadershipTotal.toFixed(2), 'bg-indigo-500')}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-12 p-10 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Level</label>
                   <select id="lead-lvl" className="w-full p-4.5 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none">
                     <option value={Level.NATIONAL}>National</option>
                     <option value={Level.REGIONAL}>Regional</option>
                     <option value={Level.DIVISION}>Division</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Position</label>
                   <select id="lead-pos" className="w-full p-4.5 bg-white border border-slate-100 rounded-2xl text-[11px] font-black outline-none">
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
                     className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                   >
                     Add Role
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                {data.leadership.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-8 bg-white rounded-[2rem] border border-slate-100 group transition-all">
                    <div className="flex items-center gap-8">
                      <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center text-3xl">
                        <i className="fas fa-certificate"></i>
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-lg tracking-tight">{item.position}</p>
                        <p className="text-[11px] text-indigo-500 font-black uppercase tracking-widest mt-1">{item.level}</p>
                      </div>
                    </div>
                    <button onClick={() => removeItem('leadership', item.id)} className="w-14 h-14 flex items-center justify-center text-red-200 hover:text-red-500 rounded-full">
                      <i className="fas fa-times-circle text-3xl"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6 animate-in fade-in">
               {renderServiceSection('5. Extension Services', 'extensionServices', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderServiceSection('Innovations', 'innovations', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION, Level.DISTRICT, Level.SCHOOL])}
               {renderServiceSection('6. Resource Speakership', 'speakership', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderServiceSection('7. Modules/Books', 'publishedBooks', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
               {renderServiceSection('8. Research Articles', 'publishedArticles', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="elegant-card p-12 rounded-[3.5rem] animate-in fade-in">
              {renderSectionHeader('Panel Interview', 'fa-microphone', totals.interviewTotal.toFixed(2), 'bg-blue-500')}
              <div className="space-y-20 max-w-4xl mx-auto py-10">
                {[
                  { key: 'principles', label: 'Journalism Principles' },
                  { key: 'leadership', label: 'Leadership Qualities' },
                  { key: 'engagement', label: 'Community Engagement' },
                  { key: 'commitment', label: 'Professionalism' },
                  { key: 'communication', label: 'Communication' }
                ].map(indicator => (
                  <div key={indicator.key} className="space-y-8">
                    <div className="flex justify-between items-end">
                      <label className="font-black text-slate-700 text-xs uppercase tracking-widest">{indicator.label}</label>
                      <div className="px-6 py-3 bg-blue-50 text-blue-600 rounded-[1.5rem] text-sm font-black tabular-nums">
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
    </div>
  );
};

export default App;
